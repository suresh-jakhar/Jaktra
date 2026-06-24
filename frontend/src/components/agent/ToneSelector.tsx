import React from "react";
import { cn } from "../../utils/cn";

export interface ToneSelectorProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
  value: string;
  onChange: (value: string) => void;
  includeAuto?: boolean;
}

export function ToneSelector({
  value,
  onChange,
  includeAuto = true,
  className,
  ...props
}: ToneSelectorProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "flex h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 text-slate-700 font-medium",
        className
      )}
      {...props}
    >
      {includeAuto && (
        <option value="">Auto (Triage Engine)</option>
      )}
      <option value="stage_1_warm">Warm (Stage 1)</option>
      <option value="stage_2_firm">Firm (Stage 2)</option>
      <option value="stage_3_serious">Serious (Stage 3)</option>
      <option value="stage_4_stern">Stern (Stage 4)</option>
    </select>
  );
}
