import { createOwner, setOwner, disposeOwner, type Owner } from '../lifecycle/ownership.js';

export type ComponentFunction<P = {}> = (props: P) => unknown;

export interface ComponentInstance {
  owner: Owner;
  result: unknown;
}

export function runComponent<P>(component: ComponentFunction<P>, props: P): ComponentInstance {
  const owner = createOwner();
  const prev = setOwner(owner);
  let result: unknown;
  try {
    result = component(props);
  } finally {
    setOwner(prev);
  }
  return { owner, result };
}

export function disposeComponent(instance: ComponentInstance): void {
  disposeOwner(instance.owner);
}
