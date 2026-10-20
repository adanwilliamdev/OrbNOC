import { Component } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { NavbarComponent } from './components/navbar/navbar.component';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, CommonModule],
  template: `
    <div class="dashboard-container">
      <app-navbar *ngIf="showNavbar"></app-navbar>
      <router-outlet></router-outlet>
    </div>
  `
})
export class AppComponent {
  showNavbar = false;
  constructor(private router: Router) {
    this.router.events.pipe(filter(event => event instanceof NavigationEnd)).subscribe((event: any) => {
      this.showNavbar = !event.url.includes('/login') && !event.url.includes('/register') && !event.url.includes('/wallboard');
    });
  }
}