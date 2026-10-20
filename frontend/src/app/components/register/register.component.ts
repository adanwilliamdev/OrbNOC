import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-logo">
          <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" style="width:48px; height:48px;">
            <rect x="0" y="0" width="48" height="48" rx="10" fill="#111827" stroke="rgba(251,191,36,0.25)" stroke-width="1"/>
            <circle cx="24" cy="24" r="14" fill="none" stroke="#FBBF24" stroke-width="2.5" stroke-dasharray="66 22" stroke-linecap="round" transform="rotate(-45 24 24)"/>
            <circle cx="24" cy="24" r="4" fill="#FBBF24" />
          </svg>
        </div>
        <h1>Criar Conta</h1>
        <p class="subtitle">Junte-se à equipe do OrbNOC</p>

        <div class="auth-form">
          <div class="field">
            <label>Nome de Usuário</label>
            <input type="text" placeholder="Ex: joao.silva" [(ngModel)]="username">
          </div>
          <div class="field">
            <label>E-mail</label>
            <input type="email" placeholder="joao@empresa.com" [(ngModel)]="email">
          </div>
          <div class="field">
            <label>Senha</label>
            <input type="password" placeholder="••••••••" [(ngModel)]="password">
          </div>
          <p class="error-msg" *ngIf="error">{{ error }}</p>
          <p class="success-msg" *ngIf="success">{{ success }}</p>
          <button class="btn-primary" (click)="onRegister()" [disabled]="loading">
            {{ loading ? 'Cadastrando...' : 'Criar Conta' }}
          </button>
        </div>

        <p class="auth-footer">Já tem uma conta? <a routerLink="/login">Fazer Login</a></p>
      </div>
    </div>
  `,
  styles: [`
    .auth-container { display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #090D16; }
    .auth-card { width: 400px; background: #111827; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 40px; box-shadow: 0 20px 60px rgba(0,0,0,0.8); text-align: center; }
    .auth-logo { display: flex; justify-content: center; margin-bottom: 20px; }
    h1 { color: #F9FAFB; font-size: 24px; margin: 0 0 8px 0; }
    .subtitle { color: #9CA3AF; font-size: 14px; margin-bottom: 32px; }
    .auth-form { display: flex; flex-direction: column; gap: 16px; text-align: left; }
    .field { display: flex; flex-direction: column; gap: 6px; }
    .field label { font-size: 12px; font-weight: 600; color: #9CA3AF; text-transform: uppercase; }
    .field input { background: #090D16; border: 1px solid rgba(255,255,255,0.08); color: #F9FAFB; padding: 12px; border-radius: 8px; font-size: 14px; outline: none; }
    .field input:focus { border-color: #6366F1; }
    .error-msg { color: #EF4444; font-size: 13px; margin: 0; }
    .success-msg { color: #10B981; font-size: 13px; margin: 0; }
    .btn-primary { background: #6366F1; color: #fff; border: none; padding: 12px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; margin-top: 8px; transition: background 0.2s; }
    .btn-primary:hover { background: #4F46E5; }
    .btn-primary:disabled { opacity: 0.5; }
    .auth-footer { color: #9CA3AF; font-size: 13px; margin-top: 24px; }
    .auth-footer a { color: #6366F1; text-decoration: none; font-weight: 600; }
    .auth-footer a:hover { text-decoration: underline; }
  `]
})
export class RegisterComponent {
  username = '';
  email = '';
  password = '';
  loading = false;
  error = '';
  success = '';

  constructor(private auth: AuthService, private router: Router) {}

  onRegister() {
    if (!this.username || !this.email || !this.password) {
      this.error = 'Preencha todos os campos.';
      return;
    }
    this.loading = true;
    this.error = '';
    this.success = '';

    this.auth.register({ username: this.username, email: this.email, password: this.password }).subscribe({
      next: (res: any) => {
        this.success = res.message;
        setTimeout(() => this.router.navigate(['/login']), 2000);
      },
      error: (err) => {
        this.error = err.error?.message || 'Falha ao cadastrar.';
        this.loading = false;
      }
    });
  }
}