import { api } from './instance';

export async function getClients() {
  try {
    console.log('Fetching clients from API...');
    const response = await api.get('/admin/clients');
    const clientsData = Array.isArray(response.data.data) ? response.data.data : [];
    return clientsData.map((client: Record<string, unknown>) => ({
      ...client,
      id: String(client.id || ''),
      createdAt: client.created_at || client.createdAt || new Date().toISOString()
    }));
  } catch (error) {
    console.error('Error fetching clients:', error);
    return [];
  }
}


