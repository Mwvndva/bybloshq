import { api } from './instance';

export async function getCreators() {
  try {
    console.log('Fetching creators from API...');
    const response = await api.get('/admin/creators');
    const creatorsData = Array.isArray(response.data.data) ? response.data.data : [];
    return creatorsData.map((creator: Record<string, unknown>) => ({
      ...creator,
      id: String(creator.id || ''),
      user_id: creator.user_id ? String(creator.user_id) : '',
      name: creator.name || `${creator.first_name || ''} ${creator.last_name || ''}`.trim() || 'Unnamed Creator',
      email: String(creator.email || ''),
      mpesaNumber: String(creator.mpesa_number || ''),
      whatsappNumber: String(creator.whatsapp_number || ''),
      balance: Number(creator.balance || 0),
      totalSales: Number(creator.total_sales || 0),
      totalEarnings: Number(creator.total_earnings || 0),
      totalReferralEarnings: Number(creator.total_referral_earnings || 0),
      totalIncome: Number(creator.total_income || 0),
      linkedShops: Number(creator.linked_shops || 0),
      linkClicks: Number(creator.link_clicks || 0),
      pendingRequests: Number(creator.pending_requests || 0),
      status: String(creator.status || 'active'),
      createdAt: creator.created_at || creator.createdAt || new Date().toISOString()
    }));
  } catch (error) {
    console.error('Error fetching creators:', error);
    return [];
  }
}

export async function deleteCreator(creatorId: string) {
  try {
    const response = await api.delete(`/admin/creators/${creatorId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting creator:', error);
    throw error;
  }
}


