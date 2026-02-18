async function checkServer() {
  try {
    const response = await fetch('http://localhost:5000/');
    const data = await response.json();
    console.log('Server response:', data);
  } catch (error) {
    console.error('Error:', error);
  }
}

checkServer();