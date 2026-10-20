import { useState, useEffect } from 'react';
import Chart from 'react-apexcharts';

export default function SafeChart(props) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready) {
    return <div style={{ height: props.height || 300 }} />;
  }

  return <Chart {...props} />;
}
