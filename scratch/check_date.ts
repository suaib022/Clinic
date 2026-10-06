import { todayDhaka } from './lib/format.js';
console.log("todayDhaka:", todayDhaka());
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
console.log("30 days ago:", thirtyDaysAgo.toISOString().split('T')[0]);
