import { DailyCronFlow } from "./flows/DailyCronFlow.ts";
import { PublicReminderFlow } from "./flows/PublicReminderFlow.ts";
import { AllInfoFlow } from "./flows/AllInfoFlow.ts";

/**
 * Ежедневная проверка (dailyCron) - реализует логику Б2 из logic.md
 * Запускается в 04:00 UTC каждый день
 */
export async function dailyCron(): Promise<Response> {
  const flow = new DailyCronFlow();
  return await flow.execute();
}

/**
 * Публичное напоминание в 20:00 UTC (publicDeadlineReminder)
 * Реализует логику Б3 из logic.md
 */
export async function publicDeadlineReminder(): Promise<Response> {
  const flow = new PublicReminderFlow();
  return await flow.execute();
}

/**
 * Функция allInfo - отправка детального отчета админу
 * Может быть вызвана отдельно через команду /allinfo
 */
export async function allInfo(): Promise<Response> {
  const flow = new AllInfoFlow();
  return await flow.execute();
} 