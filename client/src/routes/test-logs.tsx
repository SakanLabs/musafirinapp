import { createFileRoute } from "@tanstack/react-router";
import { authService } from "@/lib/auth";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/test-logs")({
  component: TestLogs,
});

function TestLogs() {
  const [result, setResult] = useState<string>("");

  const testAuthCalls = async () => {
    console.log("=== Starting auth test ===");
    
    // This should only call getCurrentUser once now
    const user = await authService.getCurrentUser();
    console.log("User result:", user);
    
    // This should use the cached user instead of calling getCurrentUser again
    const isAuth = await authService.isAuthenticated();
    console.log("Is authenticated:", isAuth);
    
    // This should also use cached user
    const isAdmin = await authService.isAdmin();
    console.log("Is admin:", isAdmin);
    
    console.log("=== Auth test complete ===");
    
    setResult(`User: ${user?.email || 'null'}, Auth: ${isAuth}, Admin: ${isAdmin}`);
  };

  useEffect(() => {
    testAuthCalls();
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Auth Logging Test</h1>
      <p className="mb-4">Check the browser console to see the logging behavior.</p>
      <p className="text-sm text-gray-600">Result: {result}</p>
      <button 
        onClick={testAuthCalls}
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Test Auth Calls Again
      </button>
    </div>
  );
}