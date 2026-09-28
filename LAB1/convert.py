import sys

def fahrenheit_to_celsius(f):
    return (f - 32) * 5 / 9

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Error: One number is required.")
        sys.exit(1)

    try:
        f = float(sys.argv[1])
    except ValueError:
        print("Error: Please enter a valid number.")
        sys.exit(1)

    c = fahrenheit_to_celsius(f)
    print(f"{f} degrees Fahrenheit is {c:.2f} degrees Celsius.")
