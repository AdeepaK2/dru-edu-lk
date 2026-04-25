'use client';

import React from 'react';
import { CheckCircle, FileText, Image as ImageIcon, X } from 'lucide-react';
import { TestQuestion, TestTemplate } from '@/models/testSchema';

interface TestTemplatePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: TestTemplate | null;
}

type PreviewOption = {
  id: string;
  text: string;
  imageUrl?: string;
  isCorrect?: boolean;
};

const getQuestionType = (question: TestQuestion) => question.questionType || question.type;

const getQuestionTitle = (question: TestQuestion) => {
  return question.questionData?.title || question.questionText || '';
};

const getQuestionContent = (question: TestQuestion) => {
  return question.questionData?.content || question.content || '';
};

const getQuestionImage = (question: TestQuestion) => {
  return question.questionData?.imageUrl || question.imageUrl;
};

const getExplanation = (question: TestQuestion) => {
  return question.questionData?.explanation || question.explanation;
};

const getExplanationImage = (question: TestQuestion) => {
  return question.questionData?.explanationImageUrl || question.explanationImageUrl;
};

const getEssayAnswer = (question: TestQuestion) => {
  const questionData = question.questionData as any;
  const questionAny = question as any;

  return {
    text: questionData?.suggestedAnswerContent || questionAny.suggestedAnswerContent || '',
    imageUrl: questionData?.suggestedAnswerImageUrl || questionAny.suggestedAnswerImageUrl || ''
  };
};

const normalizeOptions = (question: TestQuestion): PreviewOption[] => {
  if (question.questionData?.options?.length) {
    return question.questionData.options.map((option, index) => ({
      id: option.id || `option-${index}`,
      text: option.text || '',
      imageUrl: option.imageUrl
    }));
  }

  return (question.options || []).map((option: any, index) => {
    if (typeof option === 'string') {
      return {
        id: `option-${index}`,
        text: option
      };
    }

    return {
      id: option.id || `option-${index}`,
      text: option.text || option.content || '',
      imageUrl: option.imageUrl,
      isCorrect: option.isCorrect
    };
  });
};

const getCorrectOptionIndex = (question: TestQuestion, options: PreviewOption[]) => {
  if (typeof question.correctOption === 'number') {
    return question.correctOption;
  }

  const possibleCorrectAnswer = (question as any).correctAnswer ?? (question.questionData as any)?.correctAnswer;

  if (typeof possibleCorrectAnswer === 'number') {
    return possibleCorrectAnswer;
  }

  if (typeof possibleCorrectAnswer === 'string') {
    const letter = possibleCorrectAnswer.trim().toUpperCase();
    if (letter.length === 1 && letter >= 'A' && letter <= 'Z') {
      return letter.charCodeAt(0) - 'A'.charCodeAt(0);
    }
  }

  return options.findIndex(option => option.isCorrect === true);
};

export default function TestTemplatePreviewModal({
  isOpen,
  onClose,
  template
}: TestTemplatePreviewModalProps) {
  if (!isOpen || !template) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-start justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-start gap-3">
            <div className="bg-indigo-100 dark:bg-indigo-900/40 p-2 rounded-lg">
              <FileText className="h-6 w-6 text-indigo-600 dark:text-indigo-300" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {template.title}
              </h2>
              <div className="flex flex-wrap gap-2 mt-2 text-xs">
                <span className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                  {template.subjectName || 'No subject'}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                  {template.questions?.length || 0} questions
                </span>
                <span className="px-2.5 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                  {template.totalMarks || 0} marks
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Close preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-6">
          {(template.description || template.instructions) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {template.description && (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Description</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                    {template.description}
                  </p>
                </div>
              )}

              {template.instructions && (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Instructions</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                    {template.instructions}
                  </p>
                </div>
              )}
            </div>
          )}

          {template.questions.length === 0 ? (
            <div className="text-center py-12 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
              <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">This template has no questions.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {template.questions.map((question, index) => {
                const type = getQuestionType(question);
                const title = getQuestionTitle(question);
                const content = getQuestionContent(question);
                const imageUrl = getQuestionImage(question);
                const options = normalizeOptions(question);
                const correctIndex = getCorrectOptionIndex(question, options);
                const explanation = getExplanation(question);
                const explanationImage = getExplanationImage(question);
                const essayAnswer = getEssayAnswer(question);

                return (
                  <div
                    key={`${question.id || question.questionId}-${index}`}
                    className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 bg-gray-50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-indigo-600 text-white text-sm font-semibold">
                          {index + 1}
                        </span>
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white">
                            Question {index + 1}
                          </h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {(question.points || question.marks || 0)} marks
                          </p>
                        </div>
                      </div>

                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        type === 'mcq'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                      }`}>
                        {type === 'mcq' ? 'MCQ' : 'Essay'}
                      </span>
                    </div>

                    <div className="p-5 space-y-4">
                      {(title || content) && (
                        <div className="space-y-2">
                          {title && (
                            <p className="font-medium text-gray-900 dark:text-white whitespace-pre-wrap">
                              {title}
                            </p>
                          )}
                          {content && content !== title && (
                            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                              {content}
                            </p>
                          )}
                        </div>
                      )}

                      {imageUrl && (
                        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-900/40">
                          <img
                            src={imageUrl}
                            alt={`Question ${index + 1}`}
                            className="w-full max-h-[420px] object-contain"
                          />
                        </div>
                      )}

                      {type === 'mcq' ? (
                        <div className="space-y-3">
                          {options.length > 0 ? (
                            options.map((option, optionIndex) => {
                              const isCorrect = optionIndex === correctIndex;

                              return (
                                <div
                                  key={option.id || optionIndex}
                                  className={`rounded-lg border p-3 ${
                                    isCorrect
                                      ? 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                                      : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/30'
                                  }`}
                                >
                                  <div className="flex items-start gap-3">
                                    <span className={`mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold ${
                                      isCorrect
                                        ? 'bg-green-600 text-white'
                                        : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
                                    }`}>
                                      {String.fromCharCode(65 + optionIndex)}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                                          {option.text || `Option ${String.fromCharCode(65 + optionIndex)}`}
                                        </p>
                                        {isCorrect && (
                                          <span className="inline-flex items-center text-xs font-medium text-green-700 dark:text-green-300">
                                            <CheckCircle className="w-3.5 h-3.5 mr-1" />
                                            Correct answer
                                          </span>
                                        )}
                                      </div>

                                      {option.imageUrl && (
                                        <img
                                          src={option.imageUrl}
                                          alt={`Option ${String.fromCharCode(65 + optionIndex)}`}
                                          className="mt-3 max-h-56 rounded-md border border-gray-200 dark:border-gray-700 object-contain"
                                        />
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400">No options saved for this question.</p>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-lg border border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-900/20 p-4">
                          <h4 className="text-sm font-semibold text-purple-900 dark:text-purple-200 mb-2">
                            Suggested Answer
                          </h4>
                          {essayAnswer.text ? (
                            <p className="text-sm text-purple-900 dark:text-purple-100 whitespace-pre-wrap">
                              {essayAnswer.text}
                            </p>
                          ) : (
                            <p className="text-sm text-purple-700 dark:text-purple-300">
                              No suggested written answer saved.
                            </p>
                          )}
                          {essayAnswer.imageUrl && (
                            <img
                              src={essayAnswer.imageUrl}
                              alt={`Suggested answer for question ${index + 1}`}
                              className="mt-3 max-h-72 rounded-md border border-purple-200 dark:border-purple-700 object-contain"
                            />
                          )}
                        </div>
                      )}

                      {(explanation || explanationImage) && (
                        <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20 p-4">
                          <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2 flex items-center">
                            <ImageIcon className="w-4 h-4 mr-2" />
                            Explanation
                          </h4>
                          {explanation && (
                            <p className="text-sm text-blue-900 dark:text-blue-100 whitespace-pre-wrap">
                              {explanation}
                            </p>
                          )}
                          {explanationImage && (
                            <img
                              src={explanationImage}
                              alt={`Explanation for question ${index + 1}`}
                              className="mt-3 max-h-72 rounded-md border border-blue-200 dark:border-blue-700 object-contain"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end p-5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
