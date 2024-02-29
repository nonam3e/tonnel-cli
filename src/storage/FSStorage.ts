import path from "path";
import fs from "fs/promises";
import { Storage } from "./Storage";

type StorageElement =
  | string
  | number
  | boolean
  | string[]
  | number[]
  | boolean[]
  | null;

type StorageObject = {
  [k: string]: StorageElement;
};

export class FSStorage implements Storage {
  #path: string;

  constructor(path: string) {
    this.#path = path;
  }

  async #readObject(): Promise<StorageObject> {
    try {
      return JSON.parse((await fs.readFile(this.#path)).toString("utf-8"));
    } catch (e) {
      return {};
    }
  }

  async #writeObject(obj: StorageObject): Promise<void> {
    await fs.mkdir(path.dirname(this.#path), { recursive: true });
    await fs.writeFile(this.#path, JSON.stringify(obj));
  }

  async setItem(key: string, value: StorageElement): Promise<void> {
    const obj = await this.#readObject();
    obj[key] = value;
    await this.#writeObject(obj);
  }

  async getItem(key: string): Promise<string | null> {
    const obj = await this.#readObject();
    return (obj[key] as string) ?? null;
  }

  async getArray(key: string): Promise<string[] | null> {
    const obj = await this.#readObject();
    return (obj[key] as string[]) ?? null;
  }

  async removeItem(key: string): Promise<void> {
    const obj = await this.#readObject();
    delete obj[key];
    await this.#writeObject(obj);
  }
}
