import {
  HTMLAttributes,
  createContext,
  forwardRef,
  useContext,
} from "react";
import "./progress-steps.scss";

export type ProgressStepStatus = "complete" | "current" | "upcoming";

export interface ProgressStep {
  /** Name of the step, shown to the user. */
  label: string;
  /** Where this step sits relative to the one the user is on. */
  status?: ProgressStepStatus;
}

export interface ProgressStepsProps {
  /** The steps of the flow, in the order they are worked through. */
  steps: ProgressStep[];
  /** Accessible name for the progress indicator as a whole. */
  label?: string;
}

export const ProgressStepsContextDefault = forwardRef<
  HTMLOListElement,
  ProgressStepsProps & HTMLAttributes<HTMLOListElement>
>(({ steps, label = "Progress", ...rest }, ref) => (
  <ol className="dsa-progress-steps" aria-label={label} ref={ref} {...rest}>
    {steps.map((step, index) => {
      const status = step.status ?? "upcoming";
      return (
        <li
          key={`${index}-${step.label}`}
          className={`dsa-progress-steps__step dsa-progress-steps__step--${status}`}
          aria-current={status === "current" ? "step" : undefined}
        >
          <span className="dsa-progress-steps__marker" aria-hidden="true">
            {index + 1}
          </span>
          <span className="dsa-progress-steps__label">{step.label}</span>
        </li>
      );
    })}
  </ol>
));

export const ProgressStepsContext = createContext(ProgressStepsContextDefault);

export const ProgressSteps = forwardRef<
  HTMLOListElement,
  ProgressStepsProps & HTMLAttributes<HTMLOListElement>
>((props, ref) => {
  const Component = useContext(ProgressStepsContext);
  return <Component {...props} ref={ref} />;
});

ProgressSteps.displayName = "ProgressSteps";
