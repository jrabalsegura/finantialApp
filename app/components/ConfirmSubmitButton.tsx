"use client";

type ConfirmSubmitButtonProps = {
  children: React.ReactNode;
  className?: string;
  confirmMessage: string;
  disabled?: boolean;
  title?: string;
};

export function ConfirmSubmitButton({
  children,
  className,
  confirmMessage,
  disabled,
  title
}: ConfirmSubmitButtonProps) {
  return (
    <button
      className={className}
      disabled={disabled}
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
      title={title}
      type="submit"
    >
      {children}
    </button>
  );
}
