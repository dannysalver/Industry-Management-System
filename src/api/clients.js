import useApi from 'hooks/useApi';

const endpoint = '/clients';

export function useClients() {
  return useApi(endpoint);
}
