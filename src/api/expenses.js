import useApi from 'hooks/useApi';

const endpoint = '/expenses';

export function useExpenses() {
  return useApi(endpoint);
}
