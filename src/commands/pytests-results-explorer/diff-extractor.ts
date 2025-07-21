export interface Diff {
    left: string;
    right: string;
}

/**
 * Extracts the "left" and "right" sides of a complex pytest assertion error
 * as raw strings, without any conversion.
 * It intelligently finds the split point by counting brackets.
 *
 * @param longrepr The full traceback string from pytest.
 * @returns An object with the left and right sides as strings, or null if it fails to find a split.
 */
export const extractDiffStrings = (longrepr: string): Diff | null => {
    // 1. Split the multi-line traceback into individual lines.
    const lines = longrepr.split('\n');

    // 2. Find the specific line that contains the full assertion expression,
    // which pytest prefixes with 'E' and whitespace.
    const assertLine = lines.find((line) => line.trim().startsWith('E') && line.includes(' assert '));

    if (!assertLine) {
        return null; // The main assertion line was not found.
    }

    // 3. Find the start of the expression within that specific line.
    const assertPrefix = 'assert ';
    const assertIndex = assertLine.indexOf(assertPrefix);
    if (assertIndex === -1) {
        return null;
    }

    // 4. Run the bracket-counting logic ONLY on the relevant part of the line.
    const expression = assertLine.substring(assertIndex + assertPrefix.length);

    let balance = 0;
    let splitIndex = -1;

    for (let i = 0; i < expression.length; i++) {
        const char = expression[i];
        if (char === '{' || char === '[') {
            balance++;
        } else if (char === '}' || char === ']') {
            balance--;
        }

        // When balance is zero, we are outside any nested structure
        // and can safely look for the '==' operator.
        if (balance === 0) {
            const operatorIndex = expression.indexOf(' == ', i);
            if (operatorIndex > i) {
                // Ensure we find it after the current position
                splitIndex = operatorIndex;
                break;
            }
        }
    }

    if (splitIndex === -1) {
        return null;
    }

    const leftStr = expression.substring(0, splitIndex).trim();
    const rightStr = expression.substring(splitIndex + 4).trim(); // " == " is 4 chars long

    return { left: leftStr, right: rightStr };
};
