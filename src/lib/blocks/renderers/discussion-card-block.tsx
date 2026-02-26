"use client";

import { useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import type { BlockRendererProps } from "../types";
import type { DiscussionCardBlockData } from "../types";
import { Button } from "@/components/ui/button";
import { Check, Circle, MessageCircle } from "lucide-react";

export function DiscussionCardBlock({
  block,
  isActive,
  onSubmit,
}: BlockRendererProps) {
  const data = block as DiscussionCardBlockData;

  // Local state: answers per question_id
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    // Pre-populate from resolved answers if available
    if (data.answers) {
      const initial: Record<string, string> = {};
      for (const [qId, ans] of Object.entries(data.answers)) {
        initial[qId] = ans.value;
      }
      return initial;
    }
    return {};
  });

  const isResolved = !!data.decided_at || !isActive;
  const resolvedAnswers = data.answers;

  const isAnswered = (questionId: string) => {
    if (isResolved && resolvedAnswers) {
      return !!resolvedAnswers[questionId];
    }
    return !!answers[questionId]?.trim();
  };

  const allRequiredAnswered = data.questions
    .filter((q) => q.required)
    .every((q) => isAnswered(q.question_id));

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = () => {
    const payload: Record<string, { value: string }> = {};
    for (const [qId, value] of Object.entries(answers)) {
      if (value.trim()) {
        payload[qId] = { value: value.trim() };
      }
    }
    onSubmit?.({ approved: true, answers: payload });
  };

  const defaultTab =
    data.questions.length > 0 ? data.questions[0].question_id : "";

  return (
    <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-4 dark:border-purple-800 dark:bg-purple-950/50">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900">
          <MessageCircle className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
        </div>
        <h3 className="text-sm font-semibold text-purple-900 dark:text-purple-100">
          Discussion Questions
        </h3>
        <span className="text-xs text-purple-600 dark:text-purple-400">
          {data.questions.length} question
          {data.questions.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Tabs */}
      <Tabs.Root defaultValue={defaultTab} className="w-full">
        <Tabs.List className="mb-3 flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-700">
          {data.questions.map((q, idx) => {
            const answered = isAnswered(q.question_id);
            return (
              <Tabs.Trigger
                key={q.question_id}
                value={q.question_id}
                className="group relative flex shrink-0 items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 outline-none transition-colors hover:text-gray-900 data-[state=active]:text-purple-700 dark:text-gray-400 dark:hover:text-gray-200 dark:data-[state=active]:text-purple-400"
              >
                {/* Indicator: dot for unanswered, checkmark for answered */}
                {answered ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Circle className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                )}
                <span className="max-w-[120px] truncate">
                  Q{idx + 1}
                  {q.required && !answered && (
                    <span className="ml-0.5 text-red-500">*</span>
                  )}
                </span>
                {/* Active indicator bar */}
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-transparent group-data-[state=active]:bg-purple-600 dark:group-data-[state=active]:bg-purple-400" />
              </Tabs.Trigger>
            );
          })}
        </Tabs.List>

        {data.questions.map((q) => {
          const currentAnswer = isResolved
            ? resolvedAnswers?.[q.question_id]?.value ?? ""
            : answers[q.question_id] ?? "";

          return (
            <Tabs.Content
              key={q.question_id}
              value={q.question_id}
              className="rounded-md border border-gray-200 bg-white/80 p-3 dark:border-gray-700 dark:bg-gray-900/50"
            >
              {/* Question text */}
              <p className="mb-2 text-sm font-medium text-gray-800 dark:text-gray-200">
                {q.question}
                {q.required && (
                  <span className="ml-1 text-red-500 text-xs">required</span>
                )}
              </p>

              {/* Context hint */}
              {q.context && (
                <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                  {q.context}
                </p>
              )}

              {/* Input: multiple choice or free text */}
              {q.input_type === "multiple_choice" && q.options ? (
                <div className="space-y-1.5">
                  {q.options.map((option) => (
                    <label
                      key={option}
                      className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                    >
                      <input
                        type="radio"
                        name={`q-${q.question_id}`}
                        value={option}
                        checked={currentAnswer === option}
                        onChange={() =>
                          !isResolved &&
                          handleAnswerChange(q.question_id, option)
                        }
                        disabled={isResolved}
                        className="h-3.5 w-3.5 accent-purple-600"
                      />
                      <span className="text-gray-700 dark:text-gray-300">
                        {option}
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <textarea
                  value={currentAnswer}
                  onChange={(e) =>
                    !isResolved &&
                    handleAnswerChange(q.question_id, e.target.value)
                  }
                  disabled={isResolved}
                  placeholder="Type your answer..."
                  className="w-full rounded-md border border-gray-300 bg-white p-2 text-sm outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800"
                  rows={3}
                />
              )}

              {/* Show resolved answer highlight */}
              {isResolved && currentAnswer && (
                <div className="mt-2 flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                  <Check className="h-3 w-3" />
                  Answered
                </div>
              )}
            </Tabs.Content>
          );
        })}
      </Tabs.Root>

      {/* Submit button */}
      {!isResolved && isActive && (
        <div className="mt-3">
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!allRequiredAnswered}
            className="gap-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 dark:bg-purple-700 dark:hover:bg-purple-600"
          >
            <Check className="h-3.5 w-3.5" />
            Submit Answers
          </Button>
          {!allRequiredAnswered && (
            <span className="ml-2 text-xs text-gray-500">
              Answer all required questions to submit
            </span>
          )}
        </div>
      )}
    </div>
  );
}
