import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  template: `
    <div class="modal-overlay" (click)="cancelled.emit()">
      <div class="modal sm" role="alertdialog" aria-modal="true" aria-labelledby="cd-title" aria-describedby="cd-msg" (click)="$event.stopPropagation()">
        <div class="modal-body">
          <h2 id="cd-title">{{ title }}</h2>
          <p id="cd-msg">{{ message }}</p>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn-outline" (click)="cancelled.emit()">Cancelar</button>
          <button type="button" class="btn-danger" (click)="confirmed.emit()">{{ confirmLabel }}</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    h2 { font-size: 16px; font-weight: 600; margin-bottom: 8px; }
    p { color: var(--text-2); line-height: 1.55; }
  `]
})
export class ConfirmDialogComponent {
  @Input() title = 'Confirmar ação';
  @Input() message = '';
  @Input() confirmLabel = 'Excluir';
  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  @HostListener('document:keydown.escape')
  onEscape() { this.cancelled.emit(); }
}
