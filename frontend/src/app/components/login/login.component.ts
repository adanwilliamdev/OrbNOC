import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="auth">
      <aside class="auth-aside" aria-hidden="true">
        <div class="auth-brand">
          <svg viewBox="0 0 48 48"><rect width="48" height="48" rx="10" fill="#0A0F15" stroke="rgba(251,191,36,0.28)"/><circle cx="24" cy="24" r="14" fill="none" stroke="#FBBF24" stroke-width="2.5" stroke-dasharray="66 22" stroke-linecap="round" transform="rotate(-45 24 24)"/><circle cx="24" cy="24" r="4" fill="#FBBF24"/><circle cx="38" cy="24" r="2.5" fill="#3DCC91"/></svg>
          OrbNOC
        </div>

        <svg class="auth-art" viewBox="0 0 600 600" fill="none">
          <circle cx="300" cy="300" r="90" stroke="#1F2B3A"/>
          <circle cx="300" cy="300" r="170" stroke="#1F2B3A" stroke-dasharray="2 7"/>
          <g class="spin-a"><circle cx="300" cy="300" r="250" stroke="#2B3A4D"/><circle cx="550" cy="300" r="7" fill="#3DCC91"/><circle cx="550" cy="300" r="14" fill="#3DCC91" fill-opacity=".14"/></g>
          <g class="spin-b"><circle cx="300" cy="300" r="170" stroke="#2B3A4D" stroke-opacity="0"/><circle cx="130" cy="300" r="5" fill="#FBBF24"/><circle cx="300" cy="130" r="4" fill="#3DCC91"/></g>
          <g class="spin-c"><circle cx="300" cy="210" r="4" fill="#3DCC91"/><circle cx="378" cy="345" r="3.5" fill="#F26B6B"/></g>
          <circle cx="300" cy="300" r="26" fill="#FBBF24" fill-opacity=".12" stroke="#FBBF24" stroke-width="1.5"/>
          <circle cx="300" cy="300" r="7" fill="#FBBF24"/>
        </svg>

        <div class="auth-pitch">
          <h2>Veja o estado da rede em um só lugar.</h2>
          <p>Monitore ativos, abra incidentes e rode diagnósticos sem sair do painel.</p>
        </div>
      </aside>

      <main class="auth-main">
        <div class="auth-card">
          <h1>Entrar no OrbNOC</h1>
          <p class="subtitle">Use seu usuário e senha para acessar o painel.</p>

          <form class="auth-form" (ngSubmit)="onLogin()" novalidate>
            <div class="field">
              <label for="l-user">Usuário</label>
              <input id="l-user" name="username" class="input" type="text" autocomplete="username" autofocus
                     [(ngModel)]="username">
            </div>
            <div class="field">
              <label for="l-pass">Senha</label>
              <div class="pass-wrap">
                <input id="l-pass" name="password" class="input" [type]="showPass ? 'text' : 'password'" autocomplete="current-password"
                       [(ngModel)]="password">
                <button type="button" class="btn-icon pass-toggle" (click)="showPass = !showPass"
                        [attr.aria-label]="showPass ? 'Ocultar senha' : 'Mostrar senha'" [attr.aria-pressed]="showPass">
                  <svg *ngIf="!showPass" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  <svg *ngIf="showPass" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.9 17.9A10.9 10.9 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.1-5.9M9.9 4.2A10.7 10.7 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.2 3.2M1 1l22 22"/></svg>
                </button>
              </div>
            </div>
            <p class="msg error" role="alert" *ngIf="error">{{ error }}</p>
            <button type="submit" class="btn-primary" [disabled]="loading">{{ loading ? 'Entrando…' : 'Entrar' }}</button>
          </form>

          <p class="auth-footer">Ainda não tem conta? <a routerLink="/register">Criar conta</a></p>
        </div>
      </main>
    </div>
  `
})
export class LoginComponent {
  username = '';
  password = '';
  loading = false;
  showPass = false;
  error = '';

  constructor(private auth: AuthService, private router: Router) {}

  onLogin() {
    if (!this.username || !this.password) {
      this.error = 'Informe usuário e senha.';
      return;
    }
    this.loading = true;
    this.error = '';

    this.auth.login({ username: this.username, password: this.password }).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err) => {
        this.error = err.error?.message || 'Não foi possível entrar. Confira os dados e tente de novo.';
        this.loading = false;
      }
    });
  }
}
