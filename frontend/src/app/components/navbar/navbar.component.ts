import { Component, HostListener, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DeviceService } from '../../services/device.service';
import { IncidentService } from '../../services/incident.service';
import { AuthService } from '../../services/auth.service';

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
  searchResults: { title: string, type: string, url: string }[] = [];
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
    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
      event.preventDefault();
      this.openSearch();
    }
    if (event.key === 'Escape') this.closeAll();
  }

  @HostListener('document:click', ['$event'])
  clickout(event: any) {
    if (!this.eRef.nativeElement.contains(event.target)) this.closeAll();
  }

  openSearch() {
    this.searchOpen = true;
    this.profileOpen = false;
    this.searchQuery = '';
    this.searchResults = [];
    setTimeout(() => this.searchInput.nativeElement.focus(), 100);
    this.deviceService.list().subscribe(d => this.devices = d);
    this.incidentService.list().subscribe(i => this.incidents = i);
  }

  closeAll() {
    this.searchOpen = false;
    this.profileOpen = false;
  }

  onSearchChange() {
    const q = this.searchQuery.toLowerCase();
    if (!q) { this.searchResults = []; return; }
    const results: any[] = [];
    this.devices.filter(d => d.hostname.toLowerCase().includes(q) || d.ipAddress.includes(q))
      .forEach(d => results.push({ title: `Dispositivo: ${d.hostname} (${d.ipAddress})`, type: 'device', url: '/devices' }));
    this.incidents.filter(i => i.title.toLowerCase().includes(q) || i.description.toLowerCase().includes(q))
      .forEach(i => results.push({ title: `Incidente: ${i.title}`, type: 'incident', url: '/incidents' }));
    const links = [
      { title: 'Ir para Dashboard', type: 'page', url: '/dashboard' },
      { title: 'Ir para Topologia', type: 'page', url: '/topology' },
      { title: 'Ir para Ferramentas', type: 'page', url: '/tools' },
      { title: 'Ir para Auditoria', type: 'page', url: '/audit' },
    ];
    links.filter(l => l.title.toLowerCase().includes(q)).forEach(l => results.push(l));
    this.searchResults = results.slice(0, 6);
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