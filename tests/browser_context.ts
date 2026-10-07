import vm from 'node:vm';
import type {BrowserAutomation} from '../site/src/app.js';
// The functions are installed by each test's runInContext call. Fixture globals
// deliberately supply only the dependencies exercised by that test.
export function browserContext<T extends object>(globals: T): T & Omit<BrowserAutomation, keyof T> {
  return vm.createContext(globals) as T & Omit<BrowserAutomation, keyof T>;
}
