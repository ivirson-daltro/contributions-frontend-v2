import { HttpErrorResponse } from '@angular/common/http';

export function isStaleContribution(error: unknown): boolean {
  return error instanceof HttpErrorResponse &&
    (error.status === 404 ||
      ['VERSION_MISMATCH', 'CONTRIBUTION_VOIDED', 'ALREADY_VOIDED'].includes(error.error?.code));
}

export function mutationError(error: unknown, action: 'editar' | 'anular'): string {
  if (isStaleContribution(error)) {
    return 'Esta contribuição foi alterada ou não está mais disponível. Feche esta janela para atualizar a lista.';
  }
  if (error instanceof HttpErrorResponse) {
    if (error.status === 401) return 'Sua sessão expirou. Entre novamente para continuar.';
    if (error.status === 403) return 'Você não tem permissão para alterar contribuições.';
    if (error.error?.code === 'MONTH_CLOSED') return 'Este mês está fechado e não aceita alterações.';
    if (error.error?.code === 'MEMBER_REQUIRED') return 'Selecione um membro para este tipo de contribuição.';
    if (error.error?.code === 'FUTURE_DATE_NOT_ALLOWED') return 'A data do lançamento não pode ser futura.';
    if (error.error?.code === 'INVALID_REFERENCE') {
      return 'Tipo, meio de pagamento ou membro inválido ou inativo. Confira os dados.';
    }
  }
  return `Não foi possível ${action} a contribuição. Confira os dados e tente novamente.`;
}
