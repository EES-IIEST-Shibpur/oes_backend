export const getHardEndTime = (exam, attempt) => {
  const durationEnd = new Date(
    new Date(attempt.startedAt).getTime() +
      exam.durationMinutes * 60 * 1000
  );

  return new Date(
    Math.min(new Date(exam.endTime).getTime(), durationEnd.getTime())
  );
};