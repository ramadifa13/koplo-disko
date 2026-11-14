import type { ReactNode } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { Button } from "./ui";

export function ConfirmAction({
  trigger,
  title,
  description,
  confirmLabel = "Lanjutkan",
  onConfirm,
  disabled = false,
}: {
  trigger: ReactNode;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  disabled?: boolean;
}) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild disabled={disabled}>
        {trigger}
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[71] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-2xl">
          <AlertDialog.Title className="text-lg font-bold text-white">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm leading-6 text-zinc-400">
            {description}
          </AlertDialog.Description>
          <div className="mt-6 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button className="bg-zinc-800 hover:bg-zinc-700">Batal</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button
                className="bg-red-600 hover:bg-red-500"
                onClick={onConfirm}
              >
                {confirmLabel}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
