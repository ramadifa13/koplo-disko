import { useState, type ReactNode } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { Button } from "./ui";

export function ConfirmAction({
  trigger,
  title,
  description,
  confirmLabel = "Lanjutkan",
  onConfirm,
  disabled = false,
  reasonLabel,
}: {
  trigger: ReactNode;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: (reason?: string) => void;
  disabled?: boolean;
  reasonLabel?: string;
}) {
  const [reason, setReason] = useState("");
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
          {reasonLabel && (
            <label className="mt-4 block text-sm text-zinc-300">
              {reasonLabel}
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                required
                minLength={3}
                maxLength={500}
                className="mt-1 min-h-24 w-full rounded-xl border border-white/10 bg-zinc-950 p-3 text-sm text-white outline-none focus:border-[#fec400]"
              />
            </label>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button className="bg-zinc-800 hover:bg-zinc-700">Batal</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button
                className="bg-red-600 hover:bg-red-500"
                disabled={Boolean(reasonLabel && reason.trim().length < 3)}
                onClick={() => {
                  onConfirm(reason.trim() || undefined);
                  setReason("");
                }}
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
