export class ApiError extends Error {
  code: string;
  status: number;
  requestId?: string;
  constructor(code: string, status = 0, requestId?: string) {
    super(code);
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}
const messages: Record<string, string> = {
  SERVICE_UNAVAILABLE:
    'Не удалось связаться с магазином. Проверьте подключение и повторите запрос.',
  API_CONTRACT_MISMATCH:
    'Сервер вернул неожиданные данные. Проверьте совместимость версии магазина.',
  INVALID_CREDENTIALS: 'Неверный email или пароль.',
  AUTHENTICATION_FAILED: 'Неверный email или пароль.',
  ACCOUNT_NOT_CONFIRMED: 'Аккаунт ещё не подтверждён.',
  ACCOUNT_BLOCKED: 'Аккаунт заблокирован.',
  LOGIN_RATE_LIMITED:
    'Слишком много попыток входа. Попробуйте через несколько минут.',
  UNAUTHORIZED: 'Сессия истекла. Войдите снова.',
  TOKEN_EXPIRED: 'Сессия истекла. Войдите снова.',
  CART_VERSION_CONFLICT:
    'Корзина изменилась. Проверьте обновлённые позиции перед повтором.',
  PRICE_CHANGED: 'Цена изменилась. Проверьте новую сумму в корзине.',
  PRODUCT_UNAVAILABLE: 'Товар недоступен. Обновите корзину.',
  PET_NOT_AVAILABLE: 'Питомец уже недоступен.',
  INSUFFICIENT_STOCK: 'Недостаточно товара в наличии.',
  CART_EMPTY: 'Корзина пуста.',
  PROFILE_INCOMPLETE: 'Заполните контакты и адрес доставки.',
  VALIDATION_ERROR: 'Проверьте заполненные поля.',
  PAYMENT_DECLINED: 'Тестовая оплата отклонена. Попробуйте другую карту.',
  INSUFFICIENT_FUNDS: 'На тестовой карте недостаточно средств.',
  PAYMENT_STATUS_UNKNOWN:
    'Ответ об оплате не получен. Сначала проверьте результат платежа.',
  CHECKOUT_STATUS_UNKNOWN:
    'Ответ не получен. Повторите оформление: сохранённый ключ защитит от дубликата.',
  ORDER_PAYMENT_EXPIRED: 'Время оплаты истекло. Оформите новый заказ.',
  INVALID_STATUS_TRANSITION: 'Действие недоступно в текущем состоянии заказа.',
  ORDER_VERSION_CONFLICT: 'Заказ изменился. Обновите его перед повтором.',
  STORAGE_UNAVAILABLE:
    'Не удалось сохранить данные на устройстве. Повторите действие.',
  MERGE_PENDING: 'Сначала завершите объединение гостевой корзины.',
};

/** Показывает безопасное сообщение по коду, не раскрывая HTTP-тело или реквизиты. */
export function errorMessage(error: unknown): string {
  if (!(error instanceof ApiError))
    return 'Не удалось выполнить действие. Попробуйте ещё раз.';
  return (
    messages[error.code] ??
    (error.status === 401
      ? messages.UNAUTHORIZED
      : error.status === 403
        ? 'Действие недоступно для этого аккаунта.'
        : 'Не удалось выполнить действие. Обновите данные и повторите.')
  );
}

/** Отличает неопределённый сетевой результат операции от подтверждённого отказа. */
export function isUncertain(error: unknown): boolean {
  return (
    error instanceof ApiError && (error.status === 0 || error.status >= 500)
  );
}
