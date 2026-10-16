import { DavioError } from "../content";
let activeMedia = 0;
/** Per web process; the deployment must also bound replicas and request body sizes. */
export async function mediaSlot<T>(run: () => Promise<T>): Promise<T> {
  if (activeMedia >= 2)
    throw new DavioError(
      429,
      "Уже обрабатываются две фотографии. Подождите и повторите.",
    );
  activeMedia++;
  try {
    return await run();
  } finally {
    activeMedia--;
  }
}
