import type * as React from "react";
import type { MathfieldElement } from "mathlive";

/**
 * Typed JSX support for MathLive's custom <math-field> element under React 19.
 * Lives in an ambient .d.ts so the namespace augmentation is valid.
 */
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "math-field": React.DetailedHTMLProps<
        React.HTMLAttributes<MathfieldElement> & {
          ref?: React.Ref<MathfieldElement>;
          class?: string;
          "default-mode"?: "math" | "inline-math" | "text";
          "smart-mode"?: "on" | "off";
          "smart-fence"?: "on" | "off";
          "virtual-keyboard-mode"?: "auto" | "manual" | "off";
          "math-virtual-keyboard-policy"?: "auto" | "manual" | "sandboxed";
          readonly?: boolean;
          placeholder?: string;
        },
        MathfieldElement
      >;
    }
  }
}
