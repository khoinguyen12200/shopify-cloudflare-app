export function onPromiseSettled(
  promise: Promise<unknown>,
  callback: () => void,
): void {
  void promise.then(callback, callback);
}
