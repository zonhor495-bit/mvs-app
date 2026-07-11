// Утилита для замеров производительности компонентов
import { performance } from 'perf_hooks';

export interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  
  mark(name: string) {
    performance.mark(name);
  }
  
  measure(name: string, startMark: string, endMark: string) {
    try {
      performance.measure(name, startMark, endMark);
      const measure = performance.getEntriesByName(name)[0] as PerformanceMeasure;
      this.metrics.push({
        name,
        duration: measure.duration,
        timestamp: Date.now(),
      });
      return measure.duration;
    } catch (e) {
      console.error(`Failed to measure ${name}:`, e);
      return 0;
    }
  }
  
  getMetrics() {
    return this.metrics;
  }
  
  printReport() {
    console.log('\n📊 ОТЧЕТ ПРОИЗВОДИТЕЛЬНОСТИ');
    console.log('='.repeat(50));
    
    const grouped: Record<string, number[]> = {};
    this.metrics.forEach(m => {
      if (!grouped[m.name]) grouped[m.name] = [];
      grouped[m.name].push(m.duration);
    });
    
    Object.entries(grouped).forEach(([name, durations]) => {
      const avg = durations.reduce((a, b) => a + b) / durations.length;
      const max = Math.max(...durations);
      const min = Math.min(...durations);
      console.log(`
${name}
  Avg: ${avg.toFixed(2)}ms | Min: ${min.toFixed(2)}ms | Max: ${max.toFixed(2)}ms | Count: ${durations.length}
      `);
    });
  }
  
  clear() {
    this.metrics = [];
    performance.clearMarks();
    performance.clearMeasures();
  }
}

export const perfMonitor = new PerformanceMonitor();

// Декоратор для измерения производительности функций
export function measurePerf(_target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  
  descriptor.value = function(...args: any[]) {
    const startMark = `${propertyKey}-start-${Date.now()}`;
    const endMark = `${propertyKey}-end-${Date.now()}`;
    
    perfMonitor.mark(startMark);
    const result = originalMethod.apply(this, args);
    perfMonitor.mark(endMark);
    perfMonitor.measure(propertyKey, startMark, endMark);
    
    return result;
  };
  
  return descriptor;
}

// Хук для замера времени render в React
export function useRenderTime(componentName: string) {
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    const startTime = performance.now();
    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      if (duration > 16) { // > 1 frame at 60fps
        console.warn(`⚠️  [${componentName}] Долгий рендер: ${duration.toFixed(2)}ms`);
      }
    };
  }
  return () => {};
}
