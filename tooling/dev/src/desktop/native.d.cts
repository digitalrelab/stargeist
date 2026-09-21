export function loadNativeLocks(): {
  tryLock(fd: number, options: { shared: boolean }): boolean;
};
