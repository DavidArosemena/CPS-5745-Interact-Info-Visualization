<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Temperature Converter</title>
</head>
<body>
    <h1>Fahrenheit to Celsius Converter</h1>
    <h3>About this formula</h3>
    <p>This app converts a temperature from degrees Fahrenheit to degrees Celsius using the formula C = (F - 32) x 5 / 9.</p>
    <p>Author: David Arosemena | <?php echo date("F j, Y"); ?></p>

    <form method="POST" action="">
        <label for="temp">Temperature in Fahrenheit:</label>
        <input type="text" id="temp" name="temp">
        <br>
        <input type="submit" name="submit" value="Convert">
    </form>

    <?php
    if ($_SERVER["REQUEST_METHOD"] == "POST") {
        $temp = $_POST["temp"];

        // Prepare the command to run the Python script
        $command = "python3 convert.py " . escapeshellarg($temp);

        // Execute the Python script and capture the output
        $output = shell_exec($command);

        // Display the result
        echo "<h3>Result from Python script:</h3>";
        echo "<p>" . htmlspecialchars($output) . "</p>";
    }
    ?>
</body>
</html>
