import { ModeSelectionHandler } from "./ModeSelectionHandler.ts";
import { PromoCodeHandler } from "./PromoCodeHandler.ts";
import { PaymentHandler } from "./PaymentHandler.ts";

/**
 * Централизованные обработчики состояний
 */
export class StateHandlers {
  
  static async handleModeSelection(telegramId: number, mode: string): Promise<void> {
    await ModeSelectionHandler.handle(telegramId, mode);
  }
  
  static async handlePromoCode(telegramId: number, promoCode: string): Promise<void> {
    await PromoCodeHandler.handlePromoCode(telegramId, promoCode);
  }
  
  static async handleNoPromo(telegramId: number): Promise<void> {
    await PromoCodeHandler.handleNoPromo(telegramId);
  }
  
  static async handleHavePromo(telegramId: number): Promise<void> {
    await PromoCodeHandler.handleHavePromo(telegramId);
  }
}

// Экспорт функций для удобства импорта
export const handleModeSelection = StateHandlers.handleModeSelection;
export const handlePromoCode = StateHandlers.handlePromoCode;
export const handleNoPromo = StateHandlers.handleNoPromo;
export const handleHavePromo = StateHandlers.handleHavePromo; 