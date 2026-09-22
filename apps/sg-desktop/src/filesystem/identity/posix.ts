import { getSystemErrorName } from "node:util";
import koffi, { type LibraryHandle } from "koffi";

export function syscall(fn: ReturnType<LibraryHandle["func"]>, ...args: unknown[]) {
  return new Promise<number>((resolve, reject) => {
    fn.async(...args, (error: unknown, result: number) => {
      if (error) {
        reject(error);
      } else if (result < 0) {
        const code = getSystemErrorName(-koffi.errno());
        reject(Object.assign(new Error(`${fn.info.name}: ${code}`), { code }));
      } else {
        resolve(result);
      }
    });
  });
}
