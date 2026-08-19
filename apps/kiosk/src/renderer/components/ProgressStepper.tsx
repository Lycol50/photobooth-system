type ProgressStepperProps = {
  activeStep: number;
  label?: string;
  total?: number;
};

export function ProgressStepper({ activeStep, label, total = 4 }: ProgressStepperProps) {
  const safeActiveStep = Math.max(1, Math.min(total, activeStep));

  return (
    <div className="progress-stepper" aria-label={label ?? `Photo ${safeActiveStep} of ${total}`}>
      <span className="progress-stepper__label">
        {label ?? `PHOTO ${safeActiveStep} OF ${total}`}
      </span>
      <div className="progress-stepper__bars" aria-hidden="true">
        {Array.from({ length: total }, (_, index) => (
          <span
            className={`progress-stepper__bar${index < safeActiveStep ? ' is-active' : ''}`}
            key={index}
          />
        ))}
      </div>
    </div>
  );
}
