import { useState, useEffect } from 'react';
import socket from './services/socket';
import './App.css';

function App() {
  const [devices, setDevices] = useState([]);
  const [stats, setStats] = useState({ total: 0, online: 0, offline: 0 });
  const [showForm, setShowForm] = useState(false);
  const [newDevice, setNewDevice] = useState({ name: '', ip: '', location: '' });

  // Calcular estatísticas
  const calculateStats = (devicesList) => {
    const online = devicesList.filter(d => d.status === 'online').length;
    const offline = devicesList.filter(d => d.status === 'offline').length;
    setStats({
      total: devicesList.length,
      online: online,
      offline: offline
    });
  };

  // Receber atualizações do backend
  useEffect(() => {
    // Listener para atualizações dos dispositivos
    socket.on('devices_update', (updatedDevices) => {
      console.log('📡 Dispositivos atualizados:', updatedDevices);
      setDevices(updatedDevices);
      calculateStats(updatedDevices);
    });

    // Limpar listener quando componente desmontar
    return () => {
      socket.off('devices_update');
    };
  }, []);

  // Adicionar dispositivo
  const handleAddDevice = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/devices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newDevice),
      });

      if (response.ok) {
        setNewDevice({ name: '', ip: '', location: '' });
        setShowForm(false);
        console.log('✅ Dispositivo adicionado com sucesso');
      }
    } catch (error) {
      console.error('❌ Erro ao adicionar dispositivo:', error);
    }
  };

  // Remover dispositivo
  const handleRemoveDevice = async (id) => {
    try {
      const response = await fetch(`/api/devices/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        console.log('✅ Dispositivo removido com sucesso');
      }
    } catch (error) {
      console.error('❌ Erro ao remover dispositivo:', error);
    }
  };

  return (
    <div className="container">
      <h1>🔍 OrbNOC</h1>
      <p>Status: <span className="status-badge">🟢 Conectado em tempo real</span></p>

      <div className="stats">
        <div className="stat-card">
          <h3>Total</h3>
          <p className="stat-number">{stats.total}</p>
        </div>
        <div className="stat-card online">
          <h3>Online</h3>
          <p className="stat-number">{stats.online}</p>
        </div>
        <div className="stat-card offline">
          <h3>Offline</h3>
          <p className="stat-number">{stats.offline}</p>
        </div>
      </div>

      <button className="add-button" onClick={() => setShowForm(!showForm)}>
        ➕ Adicionar Dispositivo
      </button>

      {showForm && (
        <form onSubmit={handleAddDevice} className="add-form">
          <input
            type="text"
            placeholder="Nome do dispositivo"
            value={newDevice.name}
            onChange={(e) => setNewDevice({...newDevice, name: e.target.value})}
            required
          />
          <input
            type="text"
            placeholder="IP do dispositivo"
            value={newDevice.ip}
            onChange={(e) => setNewDevice({...newDevice, ip: e.target.value})}
            required
          />
          <input
            type="text"
            placeholder="Localização (opcional)"
            value={newDevice.location}
            onChange={(e) => setNewDevice({...newDevice, location: e.target.value})}
          />
          <button type="submit">Adicionar</button>
          <button type="button" onClick={() => setShowForm(false)}>Cancelar</button>
        </form>
      )}

      <table className="devices-table">
        <thead>
          <tr>
            <th>Status</th>
            <th>Nome</th>
            <th>IP</th>
            <th>Localização</th>
            <th>Último Check</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {devices.map((device) => (
            <tr key={device.id}>
              <td className={`status-${device.status}`}>
                {device.status === 'online' ? '🟢 ONLINE' : '🔴 OFFLINE'}
              </td>
              <td>{device.name}</td>
              <td>{device.ip}</td>
              <td>{device.location || '-'}</td>
              <td>{device.lastCheck ? new Date(device.lastCheck).toLocaleString() : '-'}</td>
              <td>
                <button
                  className="remove-button"
                  onClick={() => handleRemoveDevice(device.id)}
                >
                  🗑️ Remover
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="info">
        <p>🔴 O sistema monitora os dispositivos a cada 10 segundos</p>
        <p>🔵 Atualizações em tempo real ativas</p>
      </div>
    </div>
  );
}

export default App;