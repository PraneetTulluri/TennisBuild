import { Slot as SlotPrimitive } from "@radix-ui/react-slot";

// Thin re-export matching animate-ui's own wrapper shape (its source
// re-exports Radix's Slot under this same path/name) - lets components
// support `asChild` (render as whatever element/component is passed as
// a single child, merging props/ref onto it) without each one having to
// import @radix-ui/react-slot directly.
function Slot({ ...props }) {
  return <SlotPrimitive {...props} />;
}

export { Slot };
