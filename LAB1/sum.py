import sys

def calculate_sum(num1, num2):
    return num1 + num2

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Error: Two numbers are required.")
        sys.exit(1)

    try:
        num1 = float(sys.argv[1])
        num2 = float(sys.argv[2])
    except ValueError:
        print("Error: Please enter valid numbers.")
        sys.exit(1)

    result = calculate_sum(num1, num2)
    print(f"The sum of {num1} and {num2} is {result}.")
