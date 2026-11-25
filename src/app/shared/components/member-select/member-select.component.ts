import { Component, OnInit, computed, effect, input, output, signal } from '@angular/core';
import { MemberLookup } from '../../dtos/member-lookup.dto';

@Component({
  selector: 'app-member-select',
  templateUrl: './member-select.component.html',
  styleUrl: './member-select.component.scss',
})
export class MemberSelectComponent implements OnInit {
  readonly membersLoader = input.required<() => Promise<MemberLookup[]>>();
  readonly initialName = input('');
  readonly required = input(false);
  readonly label = input('Membro');
  readonly placeholder = input('Buscar membro');
  readonly showOptionalHint = input(true);
  readonly hideLabel = input(false);
  readonly selected = output<MemberLookup | null>();
  readonly queryChanged = output<string>();

  protected readonly query = signal('');
  protected readonly members = signal<MemberLookup[]>([]);
  protected readonly filteredMembers = computed(() => {
    const normalized = this.normalize(this.query());
    return normalized
      ? this.members().filter((member) => this.normalize(member.name).includes(normalized))
      : this.members();
  });
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly open = signal(false);
  private readonly initialNameEffect = effect(() => {
    this.query.set(this.initialName());
  });

  async ngOnInit(): Promise<void> {
    this.query.set(this.initialName());
    await this.loadMembers();
  }

  async loadMembers(): Promise<void> {
    if (this.members().length || this.loading()) return;

    this.loading.set(true);
    this.error.set('');
    try {
      const members = await this.membersLoader()();
      this.members.set(members);
    } catch {
      this.error.set('Não foi possível carregar os membros. Tente novamente.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async openList(): Promise<void> {
    this.open.set(true);
    await this.loadMembers();
  }

  protected closeList(): void {
    this.open.set(false);
  }

  protected filter(event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;

    const value = input.value;
    this.query.set(value);
    this.selected.emit(null);
    this.queryChanged.emit(value);
    this.open.set(true);
  }

  protected select(member: MemberLookup): void {
    this.query.set(member.name);
    this.open.set(false);
    this.queryChanged.emit(member.name);
    this.selected.emit(member);
  }

  clear(): void {
    this.query.set('');
    this.queryChanged.emit('');
    this.selected.emit(null);
  }

  protected closeOnBlur(event: FocusEvent): void {
    const container = event.currentTarget;
    if (container instanceof HTMLElement &&
        (!(event.relatedTarget instanceof Node) || !container.contains(event.relatedTarget))) {
      this.closeList();
    }
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pt-BR')
      .trim();
  }
}
