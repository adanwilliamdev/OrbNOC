import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  template: 
    <div style="font-family: Arial, sans-serif; padding: 24px; background: #0f172a; color: #e2e8f0; min-height: 100vh;">
      <h1>OrbNOC</h1>
      <p>Network Operations Center â€” Painel inicial</p>
      <p style="color: #38bdf8;">Frontend Angular pronto para conectar ao backend em <code>http://localhost:8080</code>.</p>
    </div>
  
})
export class AppComponent {
  title = 'OrbNOC';
}
