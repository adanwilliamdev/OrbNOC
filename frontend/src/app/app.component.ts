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
    <div class="shell" [class.bare]="!showNavbar">
      <app-navbar *ngIf="showNavbar"></app-navbar>
      <div class="main">
        <router-outlet></router-outlet>
      </div>
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
