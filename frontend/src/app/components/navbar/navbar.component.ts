import { Component, HostListener, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DeviceService } from '../../services/device.service';
import { IncidentService } from '../../services/incident.service';
import { AuthService } from '../../services/auth.service';

interface SearchResult { title: string; meta: string; type: 'device' | 'incident' | 'page'; url: string; }

const PAGES: SearchResult[] = [
  { title: 'Visão geral', meta: 'Ir para a tela', type: 'page', url: '/dashboard' },
  { title: 'Topologia', meta: 'Ir para a tela', type: 'page', url: '/topology' },
  { title: 'Dispositivos', meta: 'Ir para a tela', type: 'page', url: '/devices' },
  { title: 'Incidentes', meta: 'Ir para a tela', type: 'page', url: '/incidents' },
  { title: 'Ferramentas', meta: 'Ir para a tela', type: 'page', url: '/tools' },
  { title: 'Auditoria', meta: 'Ir para a tela', type: 'page', url: '/audit' },
  { title: 'Modo TV', meta: 'Ir para a tela', type: 'page', url: '/wallboard' },
];

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent {
  searchOpen = false;
  profileOpen = false;
  searchQuery = '';
  searchResults: SearchResult[] = [];
  activeIndex = 0;
  devices: any[] = [];
  incidents: any[] = [];
  user: any = null;

  @ViewChild('searchInput') searchInput!: ElementRef;

  constructor(
    private router: Router,
    private deviceService: DeviceService,
    private incidentService: IncidentService,
    private auth: AuthService,
    private eRef: ElementRef
  ) {
    this.user = this.auth.getUser();
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.openSearch();
      return;
    }
    if (event.key === 'Escape') { this.closeAll(); return; }

    if (!this.searchOpen || this.searchResults.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeIndex = (this.activeIndex + 1) % this.searchResults.length;
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeIndex = (this.activeIndex - 1 + this.searchResults.length) % this.searchResults.length;
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.goTo(this.searchResults[this.activeIndex].url);
    }
  }

  @HostListener('document:click', ['$event'])
  clickout(event: any) {
    if (!this.eRef.nativeElement.contains(event.target)) this.closeAll();
  }

  openSearch() {
    this.searchOpen = true;
    this.profileOpen = false;
    this.searchQuery = '';
    this.activeIndex = 0;
    this.searchResults = PAGES;
    setTimeout(() => this.searchInput?.nativeElement.focus(), 50);
    this.deviceService.list().subscribe(d => this.devices = d);
    this.incidentService.list().subscribe(i => this.incidents = i);
  }

  closeAll() {
    this.searchOpen = false;
    this.profileOpen = false;
  }

  onSearchChange() {
    const q = this.searchQuery.trim().toLowerCase();
    this.activeIndex = 0;
    if (!q) { this.searchResults = PAGES; return; }

    const results: SearchResult[] = [];
    this.devices
      .filter(d => (d.hostname || '').toLowerCase().includes(q) || (d.ipAddress || '').includes(q))
      .forEach(d => results.push({ title: d.hostname, meta: `Dispositivo, ${d.ipAddress}`, type: 'device', url: '/devices' }));
    this.incidents
      .filter(i => (i.title || '').toLowerCase().includes(q) || (i.description || '').toLowerCase().includes(q))
      .forEach(i => results.push({ title: i.title, meta: 'Incidente', type: 'incident', url: '/incidents' }));
    PAGES.filter(p => p.title.toLowerCase().includes(q)).forEach(p => results.push(p));
    this.searchResults = results.slice(0, 8);
  }

  goTo(url: string) {
    this.router.navigate([url]);
    this.closeAll();
  }

  toggleProfile() {
    this.profileOpen = !this.profileOpen;
    this.searchOpen = false;
  }

  logout() {
    this.auth.logout();
    this.closeAll();
  }
}
