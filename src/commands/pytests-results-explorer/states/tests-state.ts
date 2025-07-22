import type { Test } from '../types';

interface TestsState {
    tests: Test[];
}

const _state: TestsState = {
    tests: [],
};

const _observers: (() => void)[] = [];

export const getTests = () => _state.tests;

export const setTests = (tests: Test[]) => {
    _state.tests = tests;
    for (const observer of _observers) {
        observer();
    }
};

export const registerTestsChangeObserver = (callback: () => void) => {
    _observers.push(callback);
};
