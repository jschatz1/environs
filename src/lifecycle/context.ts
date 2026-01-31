import { getOwner, type Owner } from './ownership.js';

export interface Context<T> {
  id: symbol;
  defaultValue: T;
  Provider: (props: { value: T; children: unknown }) => unknown;
}

export function createContext<T>(defaultValue: T): Context<T> {
  const id = Symbol('context');

  const ctx: Context<T> = {
    id,
    defaultValue,
    Provider(props: { value: T; children: unknown }) {
      const owner = getOwner();
      if (owner) {
        owner.context.set(id, props.value);
      }
      return props.children;
    },
  };

  return ctx;
}

export function useContext<T>(context: Context<T>): T {
  let owner = getOwner();
  while (owner) {
    if (owner.context.has(context.id)) {
      return owner.context.get(context.id) as T;
    }
    owner = owner.parent;
  }
  return context.defaultValue;
}
