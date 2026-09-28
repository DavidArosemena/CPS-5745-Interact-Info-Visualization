<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Sum App</title>
</head>
<body>
    <h1>Sum App</h1>
    <p>Created by David Arosemena | <?php echo date("F j, Y"); ?></p>

    <form method="POST" action="">
        <label for="num1">Number 1:</label>
        <input type="text" id="num1" name="num1">
        <br>
        <label for="num2">Number 2:</label>
        <input type="text" id="num2" name="num2">
        <br>
        <input type="submit" name="submit" value="Calculate">
    </form>

    <?php
    if ($_SERVER["REQUEST_METHOD"] == "POST") {
        $num1 = $_POST["num1"];
        $num2 = $_POST["num2"];

        // Prepare the command to run the Python script
        $command = "python3 sum.py " . escapeshellarg($num1) . " " . escapeshellarg($num2);

        // Execute the Python script and capture the output
        $output = shell_exec($command);

        // Display the result
        echo "<h3>Result from Python script:</h3>";
        echo "<p>" . htmlspecialchars($output) . "</p>";
    }
    ?>
</body>
</html>
