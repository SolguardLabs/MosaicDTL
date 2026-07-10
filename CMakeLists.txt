cmake_minimum_required(VERSION 3.20)
project(MosaicDTL LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

file(GLOB MOSAIC_SOURCES CONFIGURE_DEPENDS src/*.cpp)
add_executable(mosaicdtl \${MOSAIC_SOURCES})
target_include_directories(mosaicdtl PRIVATE src)
