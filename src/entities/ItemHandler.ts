import { Item } from "./Item";
import { InventorySlotStack } from "./PlayerInventory";




export interface ItemHandler {
    onPickup(): InventorySlotStack[] | null;
}


export const isItemHandler = (value: unknown): value is ItemHandler => {
    if (!value || typeof value !== "object")
        return false;
    const candidate = value as Partial<ItemHandler>;
    return typeof candidate.onPickup === "function";
}