import api from './api';

export interface CalendarWatchResponse {
  success: boolean;
  channelId?: string;
  resourceId?: string;
  expiration?: number;
  message?: string;
  error?: string;
}

/**
  * Registra o webhook de notificação push (Watch Events) do Google Calendar para o profissional.
  */
export const registerCalendarWebhook = async (userId: string, calendarId: string = 'primary'): Promise<CalendarWatchResponse> => {
  try {
    const res = await api.post<CalendarWatchResponse>('/calendar/watch', {
      user_id: userId,
      calendar_id: calendarId
    });
    return res.data;
  } catch (error: any) {
    console.error('Erro ao registrar webhook do Google Calendar:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Falha ao registrar webhook.'
    };
  }
};

/**
  * Interrompe o webhook de notificação push (Stop Watch) do Google Calendar para o profissional.
  */
export const stopCalendarWebhook = async (userId: string): Promise<CalendarWatchResponse> => {
  try {
    const res = await api.post<CalendarWatchResponse>('/calendar/stop-watch', {
      user_id: userId
    });
    return res.data;
  } catch (error: any) {
    console.error('Erro ao interromper webhook do Google Calendar:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Falha ao encerrar webhook.'
    };
  }
};
