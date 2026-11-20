import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { InvitationPreview } from '../dtos/invitation-preview.dto';
import { AcceptInvitationResult } from '../dtos/accept-invitation-result.dto';
import { AcceptInvitationPayload } from '../dtos/accept-invitation-payload.dto';

@Injectable({ providedIn: 'root' })
export class InvitationService {
  private readonly http = inject(HttpClient);
  private readonly invitationsUrl = `${environment.apiUrl}/public/invitations`;

  getPreview(token: string): Promise<InvitationPreview> {
    return firstValueFrom(
      this.http.get<InvitationPreview>(`${this.invitationsUrl}/${encodeURIComponent(token)}`),
    );
  }

  accept(
    token: string,
    payload: AcceptInvitationPayload,
    accessToken?: string,
  ): Promise<AcceptInvitationResult> {
    const headers = accessToken
      ? new HttpHeaders({ Authorization: `Bearer ${accessToken}` })
      : undefined;

    return firstValueFrom(
      this.http.post<AcceptInvitationResult>(
        `${this.invitationsUrl}/${encodeURIComponent(token)}/accept`,
        payload,
        { headers },
      ),
    );
  }
}
