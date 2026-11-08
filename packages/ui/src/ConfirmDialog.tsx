"use client";

import { Button, Checkbox, Input, Modal } from "antd";
import { useEffect, useState } from "react";
import {
  settleConfirm,
  subscribeConfirm,
  type ConfirmRequest,
} from "./confirm-queue";

export function ConfirmDialog({
  title,
  message,
  summary,
  acknowledge,
  typed,
  typedValue,
  acknowledged,
  cancelLabel,
  confirmLabel,
  onTypedChange,
  onAcknowledgedChange,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  summary?: string[];
  acknowledge?: string;
  typed?: string;
  typedValue: string;
  acknowledged: boolean;
  cancelLabel: string;
  confirmLabel: string;
  onTypedChange: (value: string) => void;
  onAcknowledgedChange: (value: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const typedOk = !typed || typedValue === typed;
  const ackOk = !acknowledge || acknowledged;
  return (
    <Modal
      open
      title={title}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          {cancelLabel}
        </Button>,
        <Button
          key="ok"
          danger
          type="primary"
          disabled={!typedOk || !ackOk}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>,
      ]}
    >
      <p>{message}</p>
      {summary?.length ? (
        <ul className="confirm-summary">
          {summary.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      {acknowledge ? (
        <Checkbox
          checked={acknowledged}
          onChange={(event) => onAcknowledgedChange(event.target.checked)}
        >
          {acknowledge}
        </Checkbox>
      ) : null}
      {typed ? (
        <Input
          style={{ marginTop: 12 }}
          placeholder={typed}
          value={typedValue}
          onChange={(event) => onTypedChange(event.target.value)}
        />
      ) : null}
    </Modal>
  );
}

export function ConfirmDialogHost({
  title,
  cancelLabel,
  confirmLabel,
}: {
  title: string;
  cancelLabel: string;
  confirmLabel: string;
}) {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const [typed, setTyped] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    return subscribeConfirm((next) => {
      setTyped("");
      setAcknowledged(false);
      setRequest(next);
    });
  }, []);

  if (!request) return null;
  return (
    <ConfirmDialog
      title={title}
      message={request.message}
      summary={request.summary}
      acknowledge={request.acknowledge}
      typed={request.typed}
      typedValue={typed}
      acknowledged={acknowledged}
      cancelLabel={cancelLabel}
      confirmLabel={confirmLabel}
      onTypedChange={setTyped}
      onAcknowledgedChange={setAcknowledged}
      onCancel={() => settleConfirm(false)}
      onConfirm={() => settleConfirm(true)}
    />
  );
}
